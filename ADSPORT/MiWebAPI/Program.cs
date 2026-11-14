using ADSPORT.Data;
using ADSPORT.Services;
using Microsoft.AspNetCore.Authentication.Cookies;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


builder.Services.AddScoped<CorreoService>();
builder.Services.AddSingleton<UsuarioData>();
builder.Services.AddScoped<RolData>();
builder.Services.AddScoped<VerificacionData>();
builder.Services.AddScoped<LoginUsuarioData>();
builder.Services.AddScoped<DeporteData>();
builder.Services.AddScoped<ClaseData>();

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
            CookieSecurePolicy.Always;
        options.Cookie.SameSite =
            SameSiteMode.Lax;

        options.ExpireTimeSpan =
            TimeSpan.FromHours(8);

        options.SlidingExpiration = true;

        options.LoginPath = "/login.html";
    });

builder.Services.AddAuthorization();

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
