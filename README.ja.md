# GitHub Wiki Sync Action

[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-blue.svg)](https://github.com/features/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | **日本語**

リポジトリのフォルダとGitHub Wikiを双方向で同期するGitHub Actionです。

## 特徴

- 📁 リポジトリフォルダとGitHub Wiki間の双方向同期
- 🔄 自動競合解決（複数の戦略）
- 🗑️ 削除の同期（オプション）
- 📝 Markdownファイルの自動検出と処理
- 🔒 トランザクション管理とロールバック機能
- 🚦 高度なエラーハンドリングと再試行メカニズム
- 📊 詳細なログと同期サマリ

## 使用方法

### 基本的な使い方

```yaml
name: Sync Wiki
on:
  push:
    paths:
      - 'docs/**'
  workflow_dispatch:

jobs:
  sync-wiki:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Sync to Wiki
        uses: your-username/wiki-sync@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          sync-folder: docs
```

### 高度な設定

```yaml
- name: Sync to Wiki with Custom Settings
  uses: your-username/wiki-sync@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    sync-folder: docs
    conflict-strategy: wiki-wins
    sync-deletes: true
```

## 入力パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|------------|------|
| `token` | ✅ | - | GitHubトークン（通常は`${{ secrets.GITHUB_TOKEN }}`） |
| `sync-folder` | ❌ | `docs` | 同期するリポジトリ内のフォルダ |
| `conflict-strategy` | ❌ | `repo-wins` | 競合解決戦略（下記参照） |
| `sync-deletes` | ❌ | `true` | ファイル削除を同期するかどうか |

### 競合解決戦略

- **`repo-wins`**: リポジトリの内容を優先（デフォルト）
- **`wiki-wins`**: Wikiの内容を優先
- **`manual`**: 競合が発生したら停止し、手動解決を待つ
- **`skip`**: 競合するファイルをスキップ

## 出力

| 出力 | 説明 |
|------|------|
| `changes-count` | 適用された変更の数 |
| `sync-status` | 同期のステータス（`success` または `failed`） |

## 例

### 定期的な同期

```yaml
name: Scheduled Wiki Sync
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/wiki-sync@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          sync-folder: documentation
          conflict-strategy: wiki-wins
```

### プルリクエストでの検証

```yaml
name: Validate Wiki Sync
on:
  pull_request:
    paths:
      - 'docs/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/wiki-sync@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          sync-folder: docs
          conflict-strategy: skip
```

## アーキテクチャ

このアクションは以下のコンポーネントで構成されています：

1. **ConfigManager**: アクション入力の検証と設定管理
2. **GitHubClient**: GitHub APIとGit操作のラッパー
3. **FileHandler**: ファイルシステム操作とMarkdown処理
4. **SyncEngine**: 同期ロジックと競合解決
5. **ErrorHandler**: エラー分類と再試行メカニズム
6. **TransactionManager**: 原子性のあるオペレーションとロールバック

## トラブルシューティング

### よくある問題

1. **権限エラー**
   - `GITHUB_TOKEN`にリポジトリとWikiへの書き込み権限があることを確認してください
   - パーソナルアクセストークンを使用する場合は、`repo`スコープが必要です

2. **同期の競合**
   - 適切な`conflict-strategy`を選択してください
   - 手動解決が必要な場合は`manual`戦略を使用してください

3. **大きなリポジトリ**
   - 同期するフォルダを特定のサブディレクトリに限定することを検討してください
   - 不要なファイルは`.gitignore`に追加してください

## 貢献

貢献を歓迎します！開発を始める方法については、[コントリビューションガイド](CONTRIBUTING.ja.md)をご覧ください。

For English contributors: [Contributing Guide](CONTRIBUTING.md)

## ライセンス

このプロジェクトはMITライセンスでライセンスされています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 作者

[@your-username](https://github.com/your-username)

## サポート

問題が発生した場合は、[Issues](https://github.com/your-username/wiki-sync/issues)でバグレポートや機能リクエストを作成してください。