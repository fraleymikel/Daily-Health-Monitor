import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSaving(false);
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleChange('latitude', pos.coords.latitude.toFixed(4));
        handleChange('longitude', pos.coords.longitude.toFixed(4));
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
      }
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Customize your daily check-in experience</p>
      </div>

      <div className="settings-form">
        <div className="field">
          <label>Your Name (optional - for a personal greeting)</label>
          <input
            type="text"
            value={settings.name || ''}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="What should I call you?"
          />
        </div>

        <div className="field">
          <label>Location (for weather data)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={settings.latitude || ''}
              onChange={e => handleChange('latitude', e.target.value)}
              placeholder="Latitude"
              style={{ flex: 1 }}
            />
            <input
              type="text"
              value={settings.longitude || ''}
              onChange={e => handleChange('longitude', e.target.value)}
              placeholder="Longitude"
              style={{ flex: 1 }}
            />
            <button
              className="choice-btn"
              onClick={detectLocation}
              disabled={detectingLocation}
              style={{ whiteSpace: 'nowrap' }}
            >
              {detectingLocation ? 'Detecting...' : 'Auto-detect'}
            </button>
          </div>
        </div>

        <div className="field">
          <label>Timezone</label>
          <input
            type="text"
            value={settings.timezone || ''}
            onChange={e => handleChange('timezone', e.target.value)}
            placeholder="America/New_York"
          />
        </div>

        <div className="field">
          <div className="toggle-row">
            <div>
              <label style={{ marginBottom: 0 }}>Cycle Tracking</label>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                Track menstrual cycle day during check-ins
              </div>
            </div>
            <button
              className={`toggle ${settings.cycle_tracking === 'true' ? 'on' : ''}`}
              onClick={() => handleChange('cycle_tracking', settings.cycle_tracking === 'true' ? 'false' : 'true')}
            />
          </div>
        </div>

        {settings.cycle_tracking === 'true' && (
          <div className="field">
            <label>Average Cycle Length (days)</label>
            <input
              type="number"
              value={settings.cycle_length || '28'}
              onChange={e => handleChange('cycle_length', e.target.value)}
              min="20"
              max="45"
            />
          </div>
        )}

        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
