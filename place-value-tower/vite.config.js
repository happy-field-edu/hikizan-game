import { defineConfig } from 'vite';

// GitHub Pages では https://happy-field-edu.github.io/hikizan-game/ で配信されるため、
// アセットのパスをリポジトリ名のサブパスに合わせる。
// ローカル開発（npm run dev）では base は無視されるので影響なし。
export default defineConfig({
  base: '/hikizan-game/',
});
