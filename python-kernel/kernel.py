import sys
import base64
import traceback

def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            parts = line.strip().split('|', 2)
            if len(parts) == 3 and parts[0] == 'RUN':
                cellId = parts[1]
                b64_encoded_code = parts[2]
                
                # Decode the Python code from Base64
                code = base64.b64decode(b64_encoded_code.encode('ascii')).decode('utf-8')
                
                try:
                    # Execute code in global scope to preserve state across cells
                    exec(compile(code, f'<cell-{cellId}>', 'exec'), globals())
                except Exception:
                    # Print full traceback to stdout so it returns to the web client
                    traceback.print_exc(file=sys.stdout)
                finally:
                    # Print the exact marker string required by the frontend
                    sys.stdout.write(f'\n__NEXOS_CELL_COMPLETE__{cellId}__\n')
                    sys.stdout.flush()
        except Exception:
            # Silently ignore communication/decode errors to keep kernel alive
            pass

if __name__ == "__main__":
    main()
