/**
 * Entry point of the instance home page.
 */
import { render } from 'preact';
import { I18nProvider } from '../i18n';
import { HomeApp } from './HomeApp';
import './styles.css';

render(
  <I18nProvider>
    <HomeApp />
  </I18nProvider>,
  document.getElementById('app')!,
);
