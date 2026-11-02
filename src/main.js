import './app.css';
import '@fontsource/russo-one/400.css';
import '@fontsource-variable/rubik/wght.css';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
