#!/bin/sh
## === TUNSHELL SHELL SCRIPT ===

set -e

main() {
    case "$(uname -s):$(uname -m):$(uname -v):$(uname -a)" in
    Linux:x86_64*)     
        TARGET="x86_64-unknown-linux-musl"
        ;;
    Linux:aarch64:*:*Android*)
        TARGET="aarch64-linux-android"
        ;;
    Linux:arm64*|Linux:aarch64*)
        TARGET="aarch64-unknown-linux-musl"
        ;;
    Linux:arm*)     
        TARGET="armv7-unknown-linux-musleabihf"
        ;;
    Linux:i686:iSH*)
        TARGET="ish"
        ;;
    Linux:i686*)     
        TARGET="i686-unknown-linux-musl"
        ;;
    Linux:i586*)     
        TARGET="i586-unknown-linux-musl"
        ;;
    Linux:mips*)     
        TARGET="mips-unknown-linux-musl"
        ;;
    FreeBSD:x86_64*)
        TARGET="x86_64-unknown-freebsd"
        ;;
    FreeBSD:amd64*)
        TARGET="x86_64-unknown-freebsd"
        ;;
    FreeBSD:i686*)
        TARGET="i686-unknown-freebsd"
        ;;
    Darwin:x86_64*)    
        TARGET="x86_64-apple-darwin"
        ;;
    Darwin:arm64*)    
        TARGET="aarch64-apple-darwin"
        ;;
    WindowsNT:x86_64*|MINGW64_NT*:x86_64*)
        TARGET="x86_64-pc-windows-msvc.exe"
        ;;
    WindowsNT:i686*|MINGW32_NT*:i686*)
        TARGET="i686-pc-windows-msvc.exe"
        ;;
    *)          
        echo "Unsupported system ($(uname -a))"
        exit 1
        ;;
    esac

    if [ -w "$XDG_CACHE_HOME" ]
    then
        TEMP_PATH="$XDG_CACHE_HOME"
    elif mkdir -p $HOME/.cache
    then
        TEMP_PATH="$HOME/.cache"
    elif [ -w "$TMPDIR" ]
    then
        TEMP_PATH="$TMPDIR"
    elif [ -w "/tmp" ]
    then
        TEMP_PATH="/tmp"
    elif [ -x "$(command -v mktemp)" ]
    then
        TEMP_PATH="$(mktemp -d)"
    else
        echo "Could not find writeable temp directory"
        echo "Run again with TMPDIR=/path/to/writable/dir"
        exit 1
    fi

    TEMP_PATH="$TEMP_PATH/tunshell"
    CLIENT_PATH="$TEMP_PATH/client"

    mkdir -p $TEMP_PATH

    if [ ! -O $TEMP_PATH -a -z "$TUNSHELL_INSECURE_EXEC" ];
    then
        echo "Temp path $TEMP_PATH is not owned by current user"
        echo "Run again with TUNSHELL_INSECURE_EXEC=1 to ignore this warning" 
        exit 1
    fi

    if [ -x "$(command -v curl)" ]
    then
        INSTALL_CLIENT=true

        # Check if client is already downloaded and is up-to-date and not tampered with
        if [ -x "$(command -v grep)" ] && [ -x "$(command -v cut)" ] && [ -x "$(command -v sha256sum)" ] && [ -f $CLIENT_PATH ]
        then
            CURRENT_HASH=$(sha256sum $CLIENT_PATH | cut -d' ' -f1 || true)
            LATEST_HASH=$(curl -XHEAD -sSfI https://artifacts.tunshell.com/client-${TARGET} | grep -i 'sha256' | cut -d' ' -f2 | cut -d$'\r' -f1 || true)

            if [ ! -z "$CURRENT_HASH" ] && [ ! -z "$LATEST_HASH" ] && [ "$CURRENT_HASH" = "$LATEST_HASH" ]
            then
                echo "Client already installed..."
                INSTALL_CLIENT=false
            fi
        fi

        if [ "$INSTALL_CLIENT" = true ]
        then
            echo "Installing client..."
            curl -sSf https://artifacts.tunshell.com/client-${TARGET} -o $CLIENT_PATH
        fi
    elif [ -x "$(command -v wget)" ]
    then
        wget -q https://artifacts.tunshell.com/client-${TARGET} -O $CLIENT_PATH 
    else
        echo "Could not download client: please install curl or wget..."
        exit 1
    fi

    chmod +x $CLIENT_PATH

    $CLIENT_PATH "$@"
}

main "$@" || exit 1
