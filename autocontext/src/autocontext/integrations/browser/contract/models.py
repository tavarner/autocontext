# AUTO-GENERATED from ts/src/integrations/browser/contract/json-schemas/ — DO NOT EDIT.
# Run: node ts/scripts/sync-python-browser-contract-schemas.mjs
# CI gate: node ts/scripts/sync-python-browser-contract-schemas.mjs --check

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from typing_extensions import TypeAliasType

AllowedDomain = TypeAliasType(
    "AllowedDomain", Annotated[str, Field(pattern='^(\\*\\.)?[A-Za-z0-9.-]+$')]
)


class Params1(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    captureHtml: bool | None = None
    captureScreenshot: bool | None = None


class Params4(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(min_length=1)]


class Params5(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(min_length=1)]


class Ref(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(pattern='^@[A-Za-z0-9._:-]+$')]
    role: str | None = None
    name: str | None = None
    text: str | None = None
    selector: str | None = None
    disabled: bool | None = None


class BrowserSnapshot(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    sessionId: Annotated[str, Field(min_length=1)]
    capturedAt: AwareDatetime
    url: Annotated[str, Field(min_length=1)]
    title: str
    refs: list[Ref]
    visibleText: str
    htmlPath: str | None
    screenshotPath: str | None


class Artifacts(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    htmlPath: str | None
    screenshotPath: str | None
    downloadPath: str | None


class BrowserSessionConfig(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    profileMode: Literal['ephemeral', 'isolated', 'user-profile']
    allowedDomains: list[AllowedDomain]
    allowAuth: bool
    allowUploads: bool
    allowDownloads: bool
    captureScreenshots: bool
    headless: bool
    downloadsRoot: Annotated[str | None, Field(min_length=1)]
    uploadsRoot: Annotated[str | None, Field(min_length=1)]


class Params(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    url: Annotated[str, Field(min_length=1)]


class BrowserAction1(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['navigate']
    params: Params


class BrowserAction2(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['snapshot']
    params: Params1


class Params2(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    ref: Annotated[str, Field(pattern='^@[A-Za-z0-9._:-]+$')]


class BrowserAction3(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['click']
    params: Params2


class Params3(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    ref: Annotated[str, Field(pattern='^@[A-Za-z0-9._:-]+$')]
    text: str
    fieldKind: Literal['text', 'email', 'password', 'search', 'other'] | None = None


class BrowserAction4(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['fill']
    params: Params3


class BrowserAction5(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['press']
    params: Params4


class BrowserAction6(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    actionId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    timestamp: AwareDatetime
    type: Literal['screenshot']
    params: Params5


class BrowserAuditEvent(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    eventId: Annotated[str, Field(min_length=1)]
    sessionId: Annotated[str, Field(min_length=1)]
    actionId: Annotated[str, Field(min_length=1)]
    kind: Literal['action_result']
    allowed: bool
    policyReason: Literal[
        'allowed',
        'domain_not_allowed',
        'auth_blocked',
        'uploads_blocked',
        'downloads_blocked',
        'missing_uploads_root',
        'missing_downloads_root',
        'user_profile_requires_auth',
        'invalid_url',
    ]
    timestamp: AwareDatetime
    message: str | None = None
    beforeUrl: str | None = None
    afterUrl: str | None = None
    artifacts: Artifacts


class BrowserContractBundle(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    sessionConfig: Annotated[
        BrowserSessionConfig | None, Field(title='BrowserSessionConfig')
    ] = None
    action: Annotated[
        BrowserAction1
        | BrowserAction2
        | BrowserAction3
        | BrowserAction4
        | BrowserAction5
        | BrowserAction6
        | None,
        Field(title='BrowserAction'),
    ] = None
    snapshot: Annotated[BrowserSnapshot | None, Field(title='BrowserSnapshot')] = None
    auditEvent: Annotated[
        BrowserAuditEvent | None, Field(title='BrowserAuditEvent')
    ] = None
