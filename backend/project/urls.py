from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

def api_root(request):
    return HttpResponse("<h1>Music Learning API is Running</h1><p>Visit <b>/api/songs/</b> for data or your frontend port (usually 3000) for the app.</p>")

urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('api/', include('music_app.urls')),
]
