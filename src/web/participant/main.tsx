/**
 * Entry point of the participant view.
 */
import 'leaflet/dist/leaflet.css';
import { render } from 'preact';
import { I18nProvider } from '../i18n';
import { ParticipantApp } from './ParticipantApp';
import './styles.css';

render(
  <I18nProvider>
    <ParticipantApp />
  </I18nProvider>,
  document.getElementById('app')!,
);
