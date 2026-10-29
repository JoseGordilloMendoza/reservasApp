from django.db import migrations

from apps.businesses.search import normalize_for_search


def fill(apps, schema_editor):
    """Businesses created before the search have no normalized name yet."""
    Business = apps.get_model("businesses", "Business")
    for business in Business.objects.all():
        Business.objects.filter(pk=business.pk).update(search_name=normalize_for_search(business.name))


class Migration(migrations.Migration):
    dependencies = [("businesses", "0007_business_search")]

    # Going back needs nothing: the column is dropped with the previous migration.
    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
