from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SongViewSet, transcribe_audio

router = DefaultRouter()
router.register(r'songs', SongViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('transcribe/', transcribe_audio, name='transcribe-audio'),
]
