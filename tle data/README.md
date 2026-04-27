Place the daily static TLE file here as:

`iridium-NEXT.tle`

The app loads `./tle data/iridium-NEXT.tle` first, then does a background refresh from CelesTrak and only replaces records when the remote TLE epoch is newer.
