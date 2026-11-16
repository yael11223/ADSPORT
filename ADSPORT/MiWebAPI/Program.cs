using ADSPORT.Data;
using ADSPORT.Services;
using ADSPORT.Security;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// MVC view features register the standard ValidateAntiForgeryToken filter used by cookie APIs.
builder.Services.AddControllersWithViews();
var directorioClaves = builder.Configuration["DataProtection:KeysDirectory"];
if (!string.IsNullOrWhiteSpace(directorioClaves))
    builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(directorioClaves));
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


builder.Services.AddScoped<CorreoService>();
builder.Services.AddSingleton<UsuarioData>();
builder.Services.AddScoped<RolData>();
builder.Services.AddScoped<VerificacionData>();
builder.Services.AddScoped<LoginUsuarioData>();
builder.Services.AddScoped<IEntrenadorCuentaData, EntrenadorCuentaData>();
builder.Services.AddScoped<ClaseData>();
builder.Services.AddScoped<IAuthorizationHandler, EntrenadorAuthorizationHandler>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "ADSPORT.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
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
    options.AddPolicy("SoloEntrenador", policy => policy
        .AddAuthenticationSchemes(CookieAuthenticationDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .AddRequirements(new EntrenadorRequirement()));
    options.AddPolicy("SoloAdministrador", policy => policy
        .AddAuthenticationSchemes(CookieAuthenticationDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireClaim("ADSPORT.Administrador", "true"));
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

app.MapControllers();

app.Run();
