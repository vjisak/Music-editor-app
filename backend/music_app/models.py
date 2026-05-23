from django.db import models

class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.CharField(max_length=200, blank=True, null=True)
    cover_image = models.CharField(max_length=500, blank=True, null=True)
    instrument = models.CharField(max_length=50, default='Keyboard') 
    mood = models.CharField(max_length=50, blank=True, null=True)
    notes = models.JSONField(default=list) 
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
