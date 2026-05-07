from src.runtime import ensure_runtime


if __name__ == "__main__":
    ensure_runtime()
    from src.gui import main

    main()
