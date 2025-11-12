# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.0-beta.1] - 2025-01-11

### Major Milestones

#### Fire-and-Forget Pattern Fixes Complete (2025-01-11)

Eliminated **all 10 fire-and-forget patterns** causing state sync issues where UI actions appeared to do nothing until page refresh. This systematic initiative created **9 new hooks**, modified **30+ files**, and established a proven pattern for all async operations.

**Key Achievements:**

- 100% of identified fire-and-forget patterns addressed (7 HIGH + 3 MEDIUM priority)
- 9 custom hooks created for server-confirmed operations (`useCharacterCreation`, `useDMElevation`, `useInitiativeSetting`, `useNpcDeletion`, `useNpcCreation`, `usePropCreation`, `usePropDeletion`, `useNpcUpdate`, `usePropUpdate`, `useNpcTokenPlacement`)
- Consistent loading states and error handling across all user-facing async operations
- Professional UX with clear feedback ("Creating...", "Updating...", "Deleting...", etc.)
- Zero regressions introduced across all phases
- Pattern established for future async operations

See [CURRENT_WORK.md](CURRENT_WORK.md) and [DONE.md](DONE.md) for complete phase-by-phase documentation.

#### App.tsx Refactoring Complete (2025-10-20)

Successfully reduced App.tsx from **1,850 to 519 LOC** (-72% reduction). This major refactoring initiative extracted **29 modules**, added **616 tests**, and achieved **SOLID compliance**. The application is now more maintainable, testable, and aligned with professional engineering standards.

**Key Achievements:**

- 29 custom hooks and services extracted from monolithic component
- 616 new tests added (100% coverage on extracted modules)
- SOLID principles applied throughout architecture
- Comprehensive documentation in `docs/refactoring/`

See [docs/refactoring/](docs/refactoring/) for detailed refactoring documentation, metrics, and methodology.

### Added
- Fire-and-forget pattern fixes with 9 new hooks for server-confirmed operations
- Comprehensive loading states and error handling across all async operations
- Professional UX feedback for all user-facing operations

### Changed
- Refactored App.tsx from 1,850 to 519 LOC (-72% reduction)
- Extracted 29 modules with full test coverage
- Applied SOLID principles throughout architecture

### Fixed
- All 10 fire-and-forget patterns causing state sync issues
- UI actions appearing to do nothing until page refresh

## Previous Releases

See [DONE.md](DONE.md) for a complete archive of completed phases and milestones.
