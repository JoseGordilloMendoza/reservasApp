from . import activity

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


class SupportAuditMiddleware:
    """Writes down every change the platform team makes from inside a business's panel.

    The panel's permission marks the request when it lets support in (see HasBusiness). Reading
    is not logged, only what changes data and went through. The body is never recorded: it holds
    customers' data.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        session = getattr(request, "support_session", None)
        if session is not None and request.method not in SAFE_METHODS and response.status_code < 400:
            activity.record(
                session.user,
                activity.SUPPORT_ACTION,
                session.business,
                method=request.method,
                path=request.path,
                status=response.status_code,
                session=session.pk,
            )
        return response
