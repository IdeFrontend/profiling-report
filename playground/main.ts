async function bootstrap(): Promise<void> {
  await import('../src/ui/tokens.css');

  const fonts = new URLSearchParams(location.search).get('fonts');
  if (fonts !== 'system') {
    await import('../src/ui/fonts.css');
  }

  const { createApp } = await import('vue');
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
}

void bootstrap();
