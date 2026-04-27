import subprocess
import requests
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent

TLE_FILE = SCRIPT_DIR / "iridium-next.tle"
TIMESTAMP_FILE = SCRIPT_DIR / "last_updated.txt"

TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle"


def run_cmd(cmd, cwd):
    result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)

    if result.stdout:
        print(result.stdout.strip())
    if result.stderr:
        print(result.stderr.strip())

    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")


def fetch_tle():
    response = requests.get(TLE_URL, timeout=30)
    response.raise_for_status()

    data = response.text.strip()

    if "IRIDIUM" not in data or len(data.splitlines()) < 3:
        raise ValueError("Fetched data does not look like valid Iridium TLE data.")

    return data + "\n"


def main():
    run_cmd(["git", "pull"], cwd=REPO_DIR)

    tle_data = fetch_tle()
    TLE_FILE.write_text(tle_data, encoding="utf-8")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    TIMESTAMP_FILE.write_text(f"Last updated: {timestamp}\n", encoding="utf-8")

    status = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_DIR,
        text=True,
        capture_output=True,
        check=True
    ).stdout.strip()

    if not status:
        print("No changes detected.")
        return

    run_cmd(["git", "add", "tle_data/iridium-next.tle", "tle_data/last_updated.txt"], cwd=REPO_DIR)
    run_cmd(["git", "commit", "-m", f"Update Iridium NEXT TLE data - {timestamp}"], cwd=REPO_DIR)
    run_cmd(["git", "push"], cwd=REPO_DIR)

    print("TLE update complete.")


if __name__ == "__main__":
    main()