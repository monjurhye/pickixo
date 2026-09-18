"""Facebook Graph API integration.

Split by concern so that the thing that talks to Meta (client), the thing that
decides what a connection may do (capabilities), and the thing that classifies
failures (errors) can be reasoned about — and tested — separately.
"""
from .client import FacebookClient, PageRef
from .errors import FailureKind, GraphFailure, classify, from_network_error

__all__ = [
    "FacebookClient", "PageRef",
    "GraphFailure", "FailureKind", "classify", "from_network_error",
]
