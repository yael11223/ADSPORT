using ADSPORT.Data;
using ADSPORT.Services;
using ADSPORT.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using System.Threading.RateLimiting;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// MVC view features register the standard ValidateAntiForgeryToken filter used by cookie APIs.
builder.Services.AddControllersWithViews(options => options.Filters.Add<ApiExceptionFilter>());
var directorioClaves = builder.Configuration["DataProtection:KeysDirectory"];
if (!string.IsNullOrWhiteSpace(directorioClaves))
    builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(directorioClaves));
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


builder.Services.AddScoped<CorreoService>();
builder.Services.AddSingleton<UsuarioData>();
builder.Services.AddScoped<PerfilData>();
builder.Services.AddScoped<AdministracionData>();
builder.Services.AddScoped<RolData>();
builder.Services.AddScoped<VerificacionData>();
builder.Services.AddScoped<RegistroVerificado>();
builder.Services.AddScoped<RecuperacionPasswordData>();
builder.Services.AddSingleton<ColaCorreoRecuperacion>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ColaCorreoRecuperacion>());
builder.Services.AddScoped<LoginUsuarioData>();
builder.Services.AddScoped<IEntrenadorCuentaData, EntrenadorCuentaData>();
builder.Services.AddScoped<ClaseData>();
builder.Services.Configure<MercadoPagoOpciones>(builder.Configuration.GetSection("MercadoPago"));
builder.Services.AddScoped<PagoClaseData>();
builder.Services.AddScoped<AsistenciaClaseData>();
builder.Services.AddHostedService<ConfirmacionesPagos>();
builder.Services.AddHttpClient<MercadoPagoService>(cliente =>
{
    cliente.Timeout = TimeSpan.FromSeconds(10);
    cliente.MaxResponseContentBufferSize = 256 * 1024;
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHostedService<ConciliacionPagos>();
builder.Services.AddScoped<DeporteData>();
builder.Services.AddScoped<CanchaData>();
builder.Services.AddScoped<IAuthorizationHandler, EntrenadorAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, AdministradorAuthorizationHandler>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "ADSPORT.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new { isSuccess = false, numeroError = 429,
            respuesta = "Has hecho demasiadas solicitudes. Espera un minuto e intenta nuevamente." }, cancellationToken);
    };
    foreach (var (nombre, limite) in new[] { ("recuperacion-envio", 10), ("recuperacion-cambio", 30) })
        options.AddPolicy(nombre, context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "sin-direccion", _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limite, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
            }));
    options.AddPolicy("pagos", context => RateLimitPartition.GetFixedWindowLimiter(
        (context.Connection.RemoteIpAddress?.ToString() ?? "sin-direccion") + ":" +
        (context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonimo"),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.AddPolicy("asistencias", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonimo",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("NuevaPolitica", app =>
    {
        app.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});


builder.Services
    .AddAuthentication(
        CookieAuthenticationDefaults.AuthenticationScheme
    )
    .AddCookie(options =>
    {
        options.Cookie.Name = "ADSPORT.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy =
            builder.Environment.IsDevelopment()
                ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.Cookie.SameSite =
            SameSiteMode.Lax;

        options.ExpireTimeSpan =
            TimeSpan.FromHours(8);

        options.SlidingExpiration = true;

        options.LoginPath = "/login.html";
        options.Events.OnRedirectToLogin = context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            else context.Response.Redirect(context.RedirectUri);
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = SesionRecuperacionPassword.Validar;
        options.Events.OnRedirectToAccessDenied = context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
            else context.Response.Redirect(context.RedirectUri);
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SoloPersonal", policy => policy
        .RequireAuthenticatedUser()
        .AddRequirements(new EntrenadorRequirement(permitirAdministrador: true)));
    options.AddPolicy("SoloEntrenador", policy => policy
        .AddAuthenticationSchemes(CookieAuthenticationDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .AddRequirements(new EntrenadorRequirement()));
    options.AddPolicy("SoloAdministrador", policy => policy
        .AddAuthenticationSchemes(CookieAuthenticationDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireClaim("ADSPORT.Administrador", "true")
        .AddRequirements(new AdministradorRequirement()));
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Publica el frontend creado con HTML, CSS y JavaScript desde wwwroot.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("NuevaPolitica");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();
