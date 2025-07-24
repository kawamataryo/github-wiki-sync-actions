# GitHub Wiki Sync Action への貢献

GitHub Wiki Sync Action への貢献に興味を持っていただきありがとうございます！このドキュメントでは、プロジェクトへの貢献に関するガイドラインと手順を説明します。

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
- npmまたはyarn
- Git

### はじめに

```bash
# リポジトリをクローン
git clone https://github.com/your-username/wiki-sync.git
cd wiki-sync

# 依存関係をインストール
npm install

# TypeScriptをビルド
npm run build
```

## 開発ワークフロー

### ビルド

```bash
# TypeScriptファイルをビルド
npm run build

# 本番用ビルド（nccを使用）
npm run package
```

### テスト

```bash
# すべてのテストを実行
npm test

# 特定のテストファイルを実行
npm test -- config.test.ts

# カバレッジ付きでテストを実行
npm run test:coverage

# ウォッチモードでテストを実行
npm run test:watch
```

### コード品質

```bash
# リンターを実行
npm run lint

# コードをフォーマット
npm run format

# 型チェック
npm run typecheck
```

## プロジェクト構造

```
wiki-sync/
├── src/                    # ソースコード
│   ├── index.ts           # エントリーポイント
│   ├── config.ts          # 設定管理
│   ├── github-client.ts   # GitHub APIラッパー
│   ├── file-handler.ts    # ファイルシステム操作
│   ├── sync-engine.ts     # 同期ロジック
│   ├── error-handler.ts   # エラーハンドリング
│   ├── transaction-manager.ts  # トランザクションサポート
│   └── types.ts           # TypeScript型定義
├── tests/                  # テストファイル
│   ├── unit/              # ユニットテスト
│   ├── e2e/               # E2Eテスト
│   └── fixtures/          # テストフィクスチャ
├── .github/               # GitHub固有のファイル
│   └── workflows/         # GitHub Actionsワークフロー
├── action.yml             # アクションメタデータ
├── package.json           # パッケージ設定
├── tsconfig.json          # TypeScript設定
├── biome.json            # Biome設定
└── vitest.config.ts      # Vitest設定
```

## アーキテクチャ概要

このアクションは以下のコンポーネントで構成されています：

1. **ConfigManager**: アクション入力の検証と管理
2. **GitHubClient**: GitHub APIとGit操作のラッパー
3. **FileHandler**: ファイルシステム操作とMarkdown処理
4. **SyncEngine**: コア同期ロジックと競合解決
5. **ErrorHandler**: エラー分類と再試行メカニズム
6. **TransactionManager**: 原子性操作とロールバック機能の提供

## テストガイドライン

### ユニットテスト

- テストファイルは `tests/unit/` に配置
- わかりやすいテスト名を使用
- 外部依存関係をモック化
- 高いコードカバレッジを目指す

例：
```typescript
describe('ConfigManager', () => {
  it('should validate required token', async () => {
    // テスト実装
  })
})
```

### E2Eテスト

- テストファイルは `tests/e2e/` に配置
- アクション全体のフローをテスト
- 現実的なシナリオを使用

## コードスタイル

- 型安全性のためTypeScriptを使用
- コードフォーマットはBiomeで処理
- 既存のコードスタイルに従う
- 意味のある変数名と関数名を使用
- パブリックAPIにはJSDocコメントを追加

## コミットガイドライン

- 明確でわかりやすいコミットメッセージを使用
- Conventional Commitsフォーマットに従う：
  - `feat:` 新機能
  - `fix:` バグ修正
  - `docs:` ドキュメント変更
  - `test:` テスト変更
  - `refactor:` コードリファクタリング
  - `chore:` メンテナンスタスク

例：
```
feat: カスタム競合解決のサポートを追加
fix: 空のWikiリポジトリを正しく処理
docs: READMEに新しい例を追加
```

## プルリクエストプロセス

1. リポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更を実装
4. 新機能のテストを追加
5. すべてのテストが通ることを確認（`npm test`）
6. リンターとフォーマッターを実行（`npm run lint && npm run format`）
7. 変更をコミット
8. フォークにプッシュ
9. プルリクエストを作成

### PR要件

- すべてのテストが通ること
- コードが適切にフォーマットされていること
- 新機能にはテストが含まれていること
- 必要に応じてドキュメントを更新
- PR説明で変更内容を明確に説明

## リリースプロセス

リリースはGitHub Actionsで自動化されています：

1. `package.json`のバージョンを更新
2. `CHANGELOG.md`を更新
3. 新しいタグを作成（`git tag v1.0.0`）
4. タグをプッシュ（`git push origin v1.0.0`）
5. GitHub Actionsが自動的にリリースを作成

## ヘルプ

- 既存の[Issues](https://github.com/your-username/wiki-sync/issues)を確認
- [プルリクエスト](https://github.com/your-username/wiki-sync/pulls)でディスカッションに参加
- `question`ラベルを付けてIssuesで質問

## ライセンス

GitHub Wiki Sync Actionへの貢献により、あなたの貢献物がMITライセンスの下でライセンスされることに同意したものとみなされます。