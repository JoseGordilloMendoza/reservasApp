from django.core.management import call_command


def test_the_api_documentation_builds_without_a_single_warning(tmp_path):
    # /api/docs/ is what a developer reads to use the API: a collision of names or a view
    # without a described request makes it wrong in ways that are easy to miss.
    call_command("spectacular", "--validate", "--fail-on-warn", "--file", str(tmp_path / "schema.yml"))


def test_both_business_update_schemas_exist_under_their_own_names(tmp_path):
    output = tmp_path / "schema.yml"
    call_command("spectacular", "--file", str(output))
    text = output.read_text(encoding="utf-8")

    assert "PatchedBusinessUpdate:" in text  # what the owner may change
    assert "PatchedPlatformBusinessChanges:" in text  # what the platform team may change
    assert "BookingStatusEnum:" in text
    assert "BusinessStatusEnum:" in text
