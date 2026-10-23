import './ui/styles.css';
import { getInitialState } from './ui/state';
import { mountCheckerApp } from './ui/render';

const appRoot = document.getElementById('app');
if (appRoot) {
  const initialState = getInitialState();
  mountCheckerApp(appRoot, initialState);
}
