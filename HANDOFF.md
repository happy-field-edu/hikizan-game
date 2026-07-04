# 🤝 Claude Code 引き継ぎドキュメント

## 📋 タスク概要

ひきざんゲームのプロジェクトをGitHubにpushしてください。

ローカルにすでにプロジェクトファイル群があります。以下の手順で進めてください：

1. `gh` コマンドの導入確認・インストール
2. GitHub認証
3. プロジェクトディレクトリの準備
4. Gitリポジトリ初期化＋初回コミット
5. GitHubに新規リポジトリを作成してpush

---

## 📂 プロジェクトファイルの場所

ユーザーのダウンロードフォルダに以下のファイルがあります（Claudeから受け取ったもの）：

```
hikizan-game/
├── index.html      # メインのゲーム本体（約1.2MB、画像Base64埋め込み済み）
├── README.md       # プロジェクト説明
└── .gitignore      # Git除外設定
```

**ユーザーへの確認事項：** これらのファイルがどこに保存されているか確認してください（通常 `~/Downloads/hikizan-game/` などにあります）。

---

## 🚀 実行手順

### Step 1: 環境確認

```bash
# OS確認
uname -a

# gh コマンドの有無を確認
which gh || echo "ghは未インストール"

# git の有無を確認
which git || echo "gitは未インストール"
```

### Step 2: `gh` コマンドのインストール

OSに応じて以下を実行：

**macOS (Homebrew):**
```bash
brew install gh
```

**macOS (Homebrewが無い場合、まずHomebrewをインストール):**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install gh
```

**Ubuntu / Debian:**
```bash
(type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
&& sudo mkdir -p -m 755 /etc/apt/keyrings \
&& wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update \
&& sudo apt install gh -y
```

**Windows (winget):**
```powershell
winget install --id GitHub.cli
```

インストール後、確認：
```bash
gh --version
```

### Step 3: GitHub認証

```bash
gh auth login
```

対話形式で進めてください。推奨設定：
- **What account do you want to log into?** → `GitHub.com`
- **What is your preferred protocol for Git operations?** → `HTTPS`
- **Authenticate Git with your GitHub credentials?** → `Yes`
- **How would you like to authenticate GitHub CLI?** → `Login with a web browser`

ブラウザが開くので、表示されたワンタイムコードを入力してログインします。

認証確認：
```bash
gh auth status
```

### Step 4: プロジェクトディレクトリへ移動

ユーザーから`hikizan-game`フォルダの場所を聞いて、そこに移動：

```bash
cd ~/Downloads/hikizan-game
# または実際の場所
```

ファイルが揃っているか確認：
```bash
ls -la
# index.html, README.md, .gitignore があるはず
```

### Step 5: Gitリポジトリの初期化と初回コミット

```bash
# 初期化（main ブランチで）
git init -b main

# ユーザー情報の確認（未設定なら設定）
git config user.name || git config --global user.name "ユーザー名"
git config user.email || git config --global user.email "メールアドレス"

# ステージング
git add .

# 確認
git status

# 初回コミット
git commit -m "Initial commit: 引き算ゲーム v1.0

- 3レベル（やさしい/ふつう/むずかしい）の引き算問題
- 視覚的なヒント（絵文字表示）
- 4択クイズ形式
- キャラクター応援メッセージ（Base64埋め込み画像）
- 紙吹雪エフェクト
- 結果画面の星評価"
```

### Step 6: GitHubに新規リポジトリを作成してpush

`gh` コマンドで一発で作成＆push：

```bash
gh repo create hikizan-game \
  --public \
  --description "ロイロノートで使える子供向け引き算ゲーム" \
  --source=. \
  --remote=origin \
  --push
```

オプション説明：
- `--public`: 公開リポジトリ。プライベートにしたい場合は `--private` に変更
- `--source=.`: カレントディレクトリをソースとして使う
- `--remote=origin`: リモート名を `origin` に
- `--push`: 作成後にpushまで自動実行

### Step 7: 動作確認

```bash
# リモート確認
git remote -v

# ブラウザでGitHubページを開く
gh repo view --web
```

---

## ✅ 完了後にユーザーへ伝えること

1. ✨ リポジトリのURL（`gh repo view` で取得可能）
2. 🌐 GitHub Pagesで公開する場合の手順案内（任意）：
   ```bash
   # GitHub Pages を有効化（mainブランチのルートから配信）
   gh api -X POST repos/:owner/hikizan-game/pages \
     -f source[branch]=main -f source[path]=/
   ```
   有効化後、数分で `https://ユーザー名.github.io/hikizan-game/` で公開されます。

3. 📝 今後の開発フロー：
   ```bash
   # ファイルを変更したら
   git add .
   git commit -m "変更内容の説明"
   git push
   ```

---

## 🎮 プロジェクトの中身（参考情報）

### ゲーム概要
ロイロノートで使える、子供向けの引き算練習ゲーム。単一HTMLファイルで動作します。

### 機能
- 3つの難易度レベル（やさしい1〜10／ふつう1〜20／むずかしい1〜99）
- 全10問1セット
- 絵文字による視覚的補助（やさしい・ふつうレベル）
- 4択クイズ形式（タブレット操作に最適化）
- キャラクター（作成者の似顔絵）からの応援メッセージ
- 正解時の紙吹雪エフェクト
- 結果画面の星評価（1〜5星）

### 技術
- 単一HTMLファイル（外部依存はGoogle Fontsのみ）
- キャラクター画像はBase64でHTMLに埋め込み済み（透過PNG）
- Vanilla JavaScript、CSS Variables使用
- ファイルサイズ：約1.2MB

### 今後の開発予定（READMEより）
- [ ] 足し算バージョン
- [ ] 掛け算バージョン
- [ ] 問題数の選択機能
- [ ] BGM・効果音の追加
- [ ] 学習履歴の保存

---

## ⚠️ 注意事項

- `index.html` は画像Base64埋め込みのため**1ファイルでも約1.2MB**あります。GitHubは100MB未満なら問題なく扱えるので大丈夫です。
- 大きなバイナリ変更が頻繁になる場合、将来的に Git LFS の導入を検討してもよいでしょう（現時点では不要）。
- ユーザー名 `Fukuta` / メール `fukuta@example.com` で仮コミットしていた履歴があるかもしれませんが、ユーザー自身の情報で `git config --global` を設定すれば、それ以降のコミットは正しい情報になります。

---

## 🆘 トラブルシューティング

### `gh auth login` でブラウザが開かない場合
SSH経由などサーバー環境であれば、`--web` を `--with-token` に変えてPersonal Access Tokenを使う方法もあります：
```bash
gh auth login --with-token < token.txt
```

### push時に拒否される場合
リモートに既に何か入っている可能性があります：
```bash
git pull origin main --rebase
git push
```

### 大きなファイルで警告が出た場合
`index.html` は1.2MB程度なので警告は出ないはずですが、もし出たら無視して大丈夫です（GitHubの推奨上限50MB、最大100MB）。
