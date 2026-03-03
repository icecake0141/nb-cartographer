# NetBox Cable Diagram Generator

## English

A Flask app that generates an aggregated topology diagram from a NetBox `Cables` CSV.

### Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:8000` after startup.

### Documents

- [Specification](docs/SPEC.md)
- [Testing / Lint / Format](docs/TESTING.md)
- [API Versioning](docs/API_VERSIONING.md)
- [OpenAPI](docs/openapi.yaml)
- [Frontend Build](docs/FRONTEND_BUILD.md)
- [Migrations](docs/MIGRATIONS.md)

---

## 日本語訳

NetBox の `Cables` CSV から、デバイス間の集約トポロジ図を生成する Flask アプリです。

### インストール

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

起動後に `http://127.0.0.1:8000` を開いて利用します。

### ドキュメント

- [仕様](docs/SPEC.md)
- [テスト / Lint / Format](docs/TESTING.md)
- [API バージョニング](docs/API_VERSIONING.md)
- [OpenAPI](docs/openapi.yaml)
- [フロントエンドビルド](docs/FRONTEND_BUILD.md)
- [マイグレーション](docs/MIGRATIONS.md)
