# -*- coding: utf-8 -*-
"""Settings for dmgbuild: create a standard drag-and-drop macOS installer DMG.

Expected environment variables (set by make-electron-app.sh):
  DMG_APP  -> absolute path to WorkBuddy 皮肤管理器.app
  DMG_BG   -> absolute path to background.png
  DMG_OUT  -> absolute path for output .dmg
"""
import os

_app = os.environ.get("DMG_APP", "")
_bg = os.environ.get("DMG_BG", "")
_dmg_out = os.environ.get("DMG_OUT", "")

if not _app or not os.path.exists(_app):
    raise RuntimeError("DMG_APP environment variable must point to the .app bundle")

app_name = os.path.basename(_app)

filename = _dmg_out if _dmg_out else os.path.join(os.path.dirname(_app), "WorkBuddySkinManager.dmg")
volume_name = "WorkBuddy 皮肤管理器"
format = "UDZO"
# The raw .app is ~230 MB; give the DMG workspace enough headroom before UDZO compression.
size = "300m"

files = [_app]
symlinks = {"Applications": "/Applications"}

icon_locations = {
    app_name: (160, 180),
    "Applications": (440, 180),
}

background = _bg if _bg and os.path.exists(_bg) else None

window_rect = ((100, 100), (700, 520))
icon_size = 100
text_size = 12

show_status_bar = False
show_toolbar = False
show_tab_view = False
show_pathbar = False
show_sidebar = False
sidebar_width = 0

default_view = "icon-view"
arrangement = "free"
grid_offset = (0, 0)
grid_spacing = 100
label_pos = "bottom"

# Match the light-cream background of our background image.
background_color = (0.969, 0.953, 0.929)
