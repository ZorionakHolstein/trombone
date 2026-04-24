# Trombone trainer suite

Suite of web applications to train trombone.

For use on Linux:
```sh
git clone git@github.com:ZorionakHolstein/trombone.git
cd trombone
./start_server.sh
```

If permissions are missing just
```sh
sudo chmod a= *.sh
sudo chmod u+rwx *.sh
```

Connect to the site on localhost on port 8000. Navigate through the index of trainers to select the desired file, et voila.

For Windows, it's a simpler matter:

- Open explorer.exe (Win+R `explorer.exe` or Win+E)
- Right-click `trombone/{trainers/*.htm(l),*.htm(l)}` and select 'Open with' (then the web browser). Alternatively you can double-left-click, at least I think.

Linux depends on Python3 (`python3 -m http.server`) for the webserver (cuz im too lazy to write my own). Install with `pacman` or `apt-get`/`apt` for Arch (btw)/Debian respectively.

----

Going to rewrite the scripts in TypeScript and get around to fixing the etude generator thing later (there aren't as many hours in the day as there are muslims in London). Also will make the trombone synth sound more like a trombone and less like an harmonic whoopie cushion. ~ zhao1077
