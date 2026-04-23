# Trombone trainer suite

Suite of web applications to train trombone.

For use on Linux:
```sh
git clone git@github.com:ZorionakHolstein/trombone.git
cd trombone/trainers
python3 -m http.server 8000
```

Connect to the site on localhost on port 8000. Navigate through the index of trainers to select the desired file, et voila.

For Windows, it's a simpler matter:

- Open explorer.exe (Win+R `explorer.exe` or Win+E)
- Right-click `trombone/{trainers/*.htm(l),*.htm(l)}` and select 'Open with' (then the web browser)

Linux depends on Python3 for the webserver. Install with `pacman` or `apt-get`/`apt` for Arch/Debian respectively...
