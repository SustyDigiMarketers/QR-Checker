# Contributing to CleanCheck

We welcome contributions to CleanCheck! To maintain high code quality, strict multi-tenant security, and reliable facility operations, we adhere to a disciplined contribution process.

---

## 🏗️ Git Workflow & Branching Strategy

Our repository structure follows strict release boundaries to ensure stable production environments:

- **`main`**: Represents active, stable, verified production releases. Code here is frozen for feature additions and is only modified via `hotfix/` or formal `release/` integrations.
- **`develop`**: The main integration branch for the next release candidate (e.g., `v1.1.0`). All feature branches merge here first.
- **`feature/`**: Individual task-scoped branches for developing backward-compatible capabilities. Must target `develop` for Pull Requests.
- **`hotfix/`**: Urgent patches addressing bugs or security vulnerabilities discovered in production. Targets both `develop` and `main` once tested.

---

## 📝 Coding Standards & Style Guidelines

- **Language**: All application code must be written in **TypeScript**. Enable strict compiler flags.
- **Linter & Formatting**:
  - Run `npm run lint` to verify syntax and type declarations before submitting.
  - Adhere to the pre-configured ESLint rules and TypeScript type-safeties.
- **Component Design**:
  - Modularize components within `/src/components/` rather than consolidating multiple features into `App.tsx`.
  - Style exclusively using **Tailwind CSS** utility classes. Do not write custom `.css` rules or inline styles.
- **Database Rules**: Any additions or changes to collections in Firestore must be reflected in the schemas inside `firebase-blueprint.json` and secured by editing `firestore.rules`.

---

## 🚀 Pull Request Checklist

Before submitting a Pull Request, verify that:

1.  **Strict Typing**: Your code compiles successfully with zero warnings or `any` type escapes.
2.  **Linting**: Local linter checks pass with `npm run lint`.
3.  **No Mock Data**: No demo, test, or placeholder user records exist in production code paths.
4.  **No Console Logs**: Debugging statements (`console.log`) are removed before committing.
5.  **Documentation**: If changing API endpoints, configuration formats, or operational workflows, please update `DOCUMENTATION.md` and `README.md` to match.
