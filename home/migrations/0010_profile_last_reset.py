# Generated migration to add last_reset field to Profile model

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0009_alter_wishlistitem_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='last_reset',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
