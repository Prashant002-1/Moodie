#!/usr/bin/env python3
"""Fail closed before archiving a build that cannot reach a real service."""
import os, sys
from urllib.parse import urlparse
if os.environ.get('CONFIGURATION') != 'Release':
    sys.exit(0)
errors=[]
for key in ['MOODIE_API_URL','MOODIE_PRIVACY_URL','MOODIE_SUPPORT_URL']:
    value=os.environ.get(key,''); parsed=urlparse(value)
    host=parsed.hostname or ''
    if parsed.scheme!='https' or not host or host in ['localhost','127.0.0.1','::1'] or host.endswith(('.example','.test','.invalid')) or parsed.username or '$(' in value:
        errors.append(f'{key} must point to your real public HTTPS service.')
if not os.environ.get('MOODIE_TEAM_ID') or os.environ.get('MOODIE_TEAM_ID')=='YOUR_APPLE_TEAM_ID':
    errors.append('MOODIE_TEAM_ID must be your Apple Developer team.')
for error in errors: print('error: '+error, file=sys.stderr)
if errors: print('Configure ios/Config/Local.xcconfig before archiving. See ios/AppStore/RELEASE.md.',file=sys.stderr)
sys.exit(bool(errors))
