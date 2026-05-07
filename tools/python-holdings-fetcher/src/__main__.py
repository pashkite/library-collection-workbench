from .runtime import ensure_runtime


if __name__ == "__main__":
    ensure_runtime()
    from .gui import main

    main()
