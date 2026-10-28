from datetime import datetime, time, timedelta, timezone

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.availability.models import AvailabilityRule, Block
from apps.businesses.models import Business
from apps.catalog.models import Resource

START = datetime(2030, 1, 7, 18, 0, tzinfo=timezone.utc)


def rule(business, resource, start, end, **overrides):
    return AvailabilityRule(
        business=business,
        resource=resource,
        weekday=0,
        start_time=start,
        end_time=end,
        **overrides,
    )


def test_rule_until_midnight_is_valid(business, resource):
    AvailabilityRule.objects.create(
        business=business, resource=resource, weekday=0, start_time=time(18), end_time=time(0)
    )


@pytest.mark.parametrize("start, end", [(time(20), time(20)), (time(20), time(18))])
def test_rule_must_end_after_it_starts(business, resource, start, end):
    with pytest.raises(IntegrityError), transaction.atomic():
        rule(business, resource, start, end).save()


def test_block_must_end_after_it_starts(business, resource):
    with pytest.raises(IntegrityError), transaction.atomic():
        Block.objects.create(business=business, resource=resource, starts_at=START, ends_at=START)


def test_rule_rejects_a_resource_from_another_business(resource):
    other = Business.objects.create(slug="other", name="Other")

    with pytest.raises(ValidationError):
        rule(other, resource, time(18), time(22)).full_clean()


def test_block_rejects_a_resource_from_another_business(resource):
    other = Business.objects.create(slug="other", name="Other")
    block = Block(
        business=other, resource=resource, starts_at=START, ends_at=START + timedelta(hours=1)
    )

    with pytest.raises(ValidationError):
        block.full_clean()


def test_business_wide_block_needs_no_resource(business):
    block = Block(business=business, starts_at=START, ends_at=START + timedelta(hours=1))

    block.full_clean()


def test_resource_validation_ignores_unrelated_resources(business):
    own = Resource.objects.create(business=business, name="Own")

    rule(business, own, time(18), time(22)).full_clean()
