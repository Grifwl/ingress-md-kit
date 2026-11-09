/**
 * Entry point of the admin application.
 */
import 'leaflet/dist/leaflet.css';
import { render } from 'preact';
import { I18nProvider } from '../i18n';
import { App } from './App';
import './styles.css';

render(
  <I18nProvider>
    <App />
  </I18nProvider>,
  document.getElementById('app')!,
);
