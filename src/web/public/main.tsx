/**
 * Entry point of the public proposal page.
 */
import 'leaflet/dist/leaflet.css';
import { render } from 'preact';
import { ProposalApp } from './ProposalApp';
import './styles.css';

render(<ProposalApp />, document.getElementById('app')!);
