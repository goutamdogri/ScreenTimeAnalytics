/*
 * Screen Time Window Probe — GNOME Shell extension.
 *
 * Wayland blocks cross-app window queries by design, so the Shell itself is
 * the only component that can observe the focused window. This extension
 * tracks `global.display.focus_window` and exposes it over the session bus:
 *
 *   Service : org.screentime.WindowProbe
 *   Path    : /org/screentime/WindowProbe
 *   Method  : GetActiveWindow() → (s s) title, appId
 *
 * Empty strings mean "no window is currently focused". The paired Node-side
 * adapter (packages/adapters/src/wayland/window-probe.ts) polls this method,
 * mirroring the polling model the X11 adapter already uses.
 *
 * Install: copy this directory to
 *   ~/.local/share/gnome-shell/extensions/<uuid>/
 * then `gnome-extensions enable <uuid>` (or use Extensions).
 *
 * Requires GNOME Shell >= 45 (ESM extension format). On older Shells the
 * classic `function enable()/disable()` format would be needed instead.
 */
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DBUS_SERVICE = 'org.screentime.WindowProbe';
const DBUS_PATH = '/org/screentime/WindowProbe';
const DBUS_INTERFACE_XML = `
<node>
  <interface name="org.screentime.WindowProbe">
    <method name="GetActiveWindow">
      <arg type="s" direction="out" name="title" />
      <arg type="s" direction="out" name="appId" />
    </method>
  </interface>
</node>`;

export default class ScreenTimeWindowProbeExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._title = '';
    this._appId = '';
    this._focusSignalId = 0;
    this._dbus = null;
    this._nameOwnerId = 0;
  }

  enable() {
    this._connectFocusTracking();
    this._exportDbus();
  }

  disable() {
    if (this._dbus !== null) {
      this._dbus.unexport();
      this._dbus = null;
    }
    if (this._nameOwnerId !== 0) {
      Gio.DBus.session.unown_name(this._nameOwnerId);
      this._nameOwnerId = 0;
    }
    if (this._focusSignalId !== 0) {
      global.display.disconnect(this._focusSignalId);
      this._focusSignalId = 0;
    }
    this._clearWindow();
  }

  /* Exported D-Bus method (exact casing required by Gio). */
  GetActiveWindow() {
    return [this._title, this._appId];
  }

  _connectFocusTracking() {
    this._refreshWindow();
    this._focusSignalId = global.display.connect(
      'notify::focus-window',
      this._refreshWindow.bind(this),
    );
  }

  _exportDbus() {
    this._dbus = Gio.DBusExportedObject.wrap_methods(this, DBUS_INTERFACE_XML);
    this._dbus.export(Gio.DBus.session, DBUS_PATH);
    this._nameOwnerId = Gio.DBus.session.own_name(DBUS_SERVICE, 0, null, null);
  }

  _refreshWindow() {
    const window = global.display.focus_window;
    if (!window) {
      this._clearWindow();
      return;
    }

    let title;
    let appId;
    try {
      title = window.get_title();
      // Property defaults: an unknown window reports empty strings.
      appId =
        window.get_wm_class() ??
        window.get_wm_class_instance() ??
        window.get_gtk_application_id() ??
        '';
    } catch (error) {
      // A compositor without one of these accessors shouldn't take the
      // extension down — report "no window" instead.
      this._clearWindow();
      return;
    }
    this._title = title ?? '';
    this._appId = appId ?? '';
  }

  _clearWindow() {
    this._title = '';
    this._appId = '';
  }
}
