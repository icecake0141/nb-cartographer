# Testing / Lint / Format

## English

### Install Development Dependencies

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### Test

```bash
pytest -q
```

If imports fail (for example `ModuleNotFoundError: app`), run:

```bash
PYTHONPATH=. pytest -q
```

### Lint

```bash
ruff check .
```

### Format

```bash
ruff format .
```

### API Smoke Test

```bash
# 1) Create import run
curl -X POST -F "csv_file=@samples/netbox_cables.csv" http://127.0.0.1:8000/api/imports

# 2) Execute
curl -X POST http://127.0.0.1:8000/api/imports/<id>/execute

# 3) Get graph
curl "http://127.0.0.1:8000/api/graphs/<id>?view=device"
```

### Test Files

- Public sample: `samples/netbox_cables.csv`
- Local import destination: `import/` (excluded by `.gitignore`)

---

## 日本語訳

### 開発依存のインストール

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### テスト

```bash
pytest -q
```

import で失敗する場合（例: `ModuleNotFoundError: app`）は、次を実行してください:

```bash
PYTHONPATH=. pytest -q
```

### Lint

```bash
ruff check .
```

### Format

```bash
ruff format .
```

### API スモークテスト

```bash
# 1) import run を作成
curl -X POST -F "csv_file=@samples/netbox_cables.csv" http://127.0.0.1:8000/api/imports

# 2) 実行
curl -X POST http://127.0.0.1:8000/api/imports/<id>/execute

# 3) グラフ取得
curl "http://127.0.0.1:8000/api/graphs/<id>?view=device"
```

### テスト用ファイル

- 公開サンプル: `samples/netbox_cables.csv`
- ローカル投入先: `import/`（`.gitignore` で除外）
