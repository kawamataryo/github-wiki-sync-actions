# GitHub Wiki Sync Action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Wiki%20Sync-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAM6wAADOsB5dZE0gAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAERSURBVCiRhZG/SsMxFEZPfsVJ61jbxaF0cRQRcRJ9hlYn30IHN/+9iquDCOIsblIrOjqKgy5aKoJQj4O3EEtbPwhJbr6Te28CmdSKeqzeqr0YbfVIrTBKakvtOl5dtTkK+v4HfA9PEyBFCY9AGVgCBLaBp1jPAyfAJ/AAdIEG0dNAiyP7+K1qIfMdonZic6+WJoBJvQlvuwDqcXadUuqPA1NKAlexbRTAIMvMOCjTbMwl1LtI/6KWJ5Q6rT6Ht1MA58AX8Apcqqt5r2qhrgAXQC3CZ6i1+KMd9TRu3MvA3aH/fFPnBodb6oe6HM8+lYHrGdRXW8M9bMZtPXUji69lmf5Cmamq7quNLFZXD9Rq7v0Bpc1o/tp0fisAAAAASUVORK5CYII=)](https://github.com/marketplace/actions/github-wiki-sync)

**English** | [日本語](README.ja.md)

Synchronize your repository documentation folder with GitHub Wiki bidirectionally. Keep your docs in sync effortlessly!

## Features

- 🔄 **Bidirectional Sync**: Automatically sync changes from repository to wiki
- 📁 **Folder Support**: Sync entire folder structures with proper naming conventions
- 🛡️ **Conflict Resolution**: Multiple strategies for handling sync conflicts
- 📊 **Detailed Logging**: Clear execution logs and error reporting
- ⚡ **Fast & Efficient**: Optimized for performance with minimal API calls

## Quick Start

### Basic Usage

```yaml
name: Sync Wiki

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Sync to Wiki
          uses: kawamataryo/github-wiki-sync-actions@v0.0.1        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          sync-folder: 'docs'
          conflict-strategy: 'repo-wins'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token with repo and wiki access | ✅ | - |
| `sync-folder` | Folder path to synchronize with wiki | ❌ | `docs` |
| `conflict-strategy` | Strategy for handling conflicts (`repo-wins`, `wiki-wins`, `manual`, `skip`) | ❌ | `repo-wins` |

## Outputs

| Output | Description |
|--------|-------------|
| `changes-count` | Number of changes applied during sync |
| `sync-status` | Overall sync status (`success`, `partial`, `failed`) |

## Conflict Resolution Strategies

- **`repo-wins`**: Repository changes take precedence (default)
- **`wiki-wins`**: Wiki changes take precedence
- **`manual`**: Log conflicts for manual resolution
- **`skip`**: Skip files with conflicts

## File Naming Conventions

The action automatically converts between file paths and wiki page names:

| Repository Path | Wiki Page Name |
|-----------------|----------------|
| `docs/README.md` | `README` |
| `docs/guide/getting-started.md` | `guide-getting-started` |
| `docs/api/reference.md` | `api-reference` |

## Advanced Usage

### Sync on Wiki Changes

```yaml
name: Sync from Wiki

on:
  gollum:  # Wiki change event
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    
    steps:
      - uses: actions/checkout@v4
      - uses: your-username/wiki-sync@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          sync-folder: 'docs'
          conflict-strategy: 'wiki-wins'
```

### Custom Token with Enhanced Permissions

```yaml
      - uses: your-username/wiki-sync@v1
        with:
          token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
          sync-folder: 'documentation'
```

## Permissions

The GitHub token needs the following permissions:
- `contents: write` - To read and write repository files
- Wiki access is included with the default `GITHUB_TOKEN`

For cross-repository sync or enhanced features, use a Personal Access Token with:
- `repo` scope
- `gist` scope (if syncing gists)

## Troubleshooting

### Common Issues

#### Error: "GitHub token is required"
**Solution**: Ensure the token is properly set in your workflow:
```yaml
with:
  token: ${{ secrets.GITHUB_TOKEN }}
```

#### Error: "Sync folder path should be relative, not absolute"
**Solution**: Use relative paths like `docs` instead of `/docs` or absolute paths.

#### Wiki pages not updating
**Possible causes**:
1. Token lacks wiki permissions
2. Wiki is disabled for the repository
3. Branch protection rules preventing updates

### Debug Mode

Enable debug logging by setting the secret:
```
ACTIONS_STEP_DEBUG: true
```

## Examples

### Multi-folder Sync

```yaml
strategy:
  matrix:
    folder: ['docs', 'guides', 'api']

steps:
  - uses: actions/checkout@v4
  - uses: your-username/wiki-sync@v1
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      sync-folder: ${{ matrix.folder }}
```

### Scheduled Sync

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

For Japanese contributors: [コントリビューションガイド](CONTRIBUTING.ja.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report bugs](https://github.com/your-username/wiki-sync/issues)
- 💡 [Request features](https://github.com/your-username/wiki-sync/issues)
- 📖 [Read the docs](https://github.com/your-username/wiki-sync/wiki)

---

Made with ❤️ for the GitHub community
