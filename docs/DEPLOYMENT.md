# Deploying CaviNet on a team laptop

This guide installs CaviNet on one **Windows, macOS or Linux laptop** and runs the full demo
with one command (`make up`). It is written for the project team; no programming is needed.
Using CaviNet once it runs is covered in [USER_MANUAL.md](USER_MANUAL.md).

> CaviNet is a research prototype. Run it for demonstrations and evaluation only, with
> made-up or properly de-identified data, and never as a hospital system.

## Contents

1. [What you need](#1-what-you-need)
2. [Install the tools (once per laptop)](#2-install-the-tools-once-per-laptop)
3. [Get CaviNet](#3-get-cavinet)
4. [Start CaviNet](#4-start-cavinet)
5. [First sign-in](#5-first-sign-in)
6. [Check the demo works](#6-check-the-demo-works)
7. [Everyday use](#7-everyday-use)
8. [Settings (.env)](#8-settings-env)
9. [Installing the trained model](#9-installing-the-trained-model)
10. [Backups](#10-backups)
11. [Updating to a new version](#11-updating-to-a-new-version)
12. [Using CaviNet from other computers](#12-using-cavinet-from-other-computers)
13. [Troubleshooting](#13-troubleshooting)
14. [Removing CaviNet](#14-removing-cavinet)
15. [Setup timing checklist](#15-setup-timing-checklist)

## 1. What you need

| | Minimum | Notes |
|---|---|---|
| Operating system | Windows 10/11 (64-bit), macOS 13 or later, or a recent Linux (e.g. Ubuntu 22.04) | Intel/AMD or Apple silicon (M1 to M4) |
| Memory (RAM) | **8 GB** | Analysing a 300-slice scan used about 2.6 GB for all of CaviNet (2.4 GB in the analysis worker); Docker must be allowed **at least 4 GB** |
| Processor | 4 cores recommended | A 300-slice scan took about 75 seconds on 4 CPU cores and about 2 minutes on 2 (the target is under 3 minutes). No graphics card (GPU) is needed |
| Free disk space | **10 GB** | For the software images, the database and stored scans |
| Internet | For the first start and for updates | The first start downloads roughly 1 to 1.5 GB. Afterwards CaviNet runs offline |
| Browser | A recent Chrome, Edge or Firefox | At least 1280 pixels wide |

Everything else (Python, Node.js, PostgreSQL, the AI libraries) runs inside Docker; you do
not install it yourself.

## 2. Install the tools (once per laptop)

You need **Docker Desktop**, **git** and **make**.

### macOS

1. Install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/), choosing
   the version for your chip ( > About This Mac: "Apple M…" means **Apple silicon**,
   "Intel" means **Intel chip**). Open it once and wait until it says "Engine running".
2. Open **Terminal** and run `xcode-select --install` (this installs git and make). Accept the
   prompts.
3. In Docker Desktop: **Settings > Resources > Memory**: at least **4 GB**. Click
   **Apply & restart**.

### Windows

CaviNet's commands run inside **WSL** (Windows Subsystem for Linux), a Linux terminal built into
Windows.

1. Open **PowerShell as administrator** and run `wsl --install`. Restart when asked. On first
   start, Ubuntu asks for a Linux user name and password (any; remember the password).
2. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/). During
   setup keep **"Use WSL 2 instead of Hyper-V"** ticked. Open it once and wait until it says
   "Engine running".
3. In Docker Desktop: **Settings > Resources > WSL integration**: turn on **Ubuntu**. Click
   **Apply & restart**.
4. Open **Ubuntu** from the Start menu and run:

   ```bash
   sudo apt update && sudo apt install -y git make
   ```

5. Run every command in this guide in the **Ubuntu** window, and keep CaviNet in your Linux
   home folder (`cd ~`), **not** under `/mnt/c/...`: it is much faster there.

Docker Desktop on Windows uses up to half of the laptop's memory by default, which is enough on
an 8 GB laptop.

### Linux

Install [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin, plus
git and make (Ubuntu: `sudo apt install -y git make`). Add yourself to the `docker` group so
Docker runs without `sudo` (`sudo usermod -aG docker $USER`, then sign out and in again).

### Check the tools

```bash
docker --version          # Docker version 24 or later
docker compose version    # Docker Compose version v2...
git --version
make --version
```

## 3. Get CaviNet

```bash
cd ~
git clone https://github.com/ahmadraza225/CaviNet_V1.git
cd CaviNet_V1
```

The repository is private. If `git clone` asks for a password, either use
[GitHub Desktop](https://desktop.github.com/) (sign in, **Clone repository**, pick
`CaviNet_V1`, then open a terminal in that folder), or create a personal access token on GitHub
and paste it when asked for the password.

## 4. Start CaviNet

```bash
make up
```

The **first** `make up`:

1. creates the settings file `.env` with freshly generated passwords and secrets, and prints
   the **first administrator's sign-in** (also stored in `.env`);
2. downloads and builds the software images (most of the time is here; it depends on your
   internet speed);
3. trains the small **demo AI model** (about 1 to 2 minutes), unless a model is already in
   `models/`;
4. starts every service and waits until CaviNet answers.

It ends with:

```text
CaviNet is up: {"status":"ok","version":"...","database":"ok","redis":"ok"}
Open http://localhost:8080
```

How long it takes: on GitHub's build servers (fast network, 4 cores) the first `make up` takes
about **4.5 minutes**. On a laptop, add the download time: roughly 1 minute per 150 MB at
20 Mbit/s, so about 8 to 10 minutes extra on a typical home connection. **Before a
demonstration, run the first `make up` in advance on a good connection.** Later starts take
seconds.

## 5. First sign-in

1. Open **http://localhost:8080**.
2. Sign in with the administrator's email and password printed by `make up`. To see them again:

   ```bash
   grep ADMIN_ .env
   ```

3. Choose your own password (at least 10 characters, with a letter and a digit). From now on the
   password in `.env` no longer works for this account.
4. On the **Users** page, create an account for each doctor (see the
   [user manual](USER_MANUAL.md#10-users)).

For a quick demo, `make seed` also creates a demo doctor whose sign-in is in `.env`
(`DEMO_DOCTOR_EMAIL`, `DEMO_DOCTOR_PASSWORD`).

## 6. Check the demo works

```bash
make seed        # the demo doctor
make demo-scan   # writes two synthetic test scans (no real patient) to demo-data/
```

Then, as the demo doctor:

1. add a made-up patient;
2. click **Upload CT** and choose `demo-data/synthetic_chest_ct.zip`;
3. the case page follows the analysis to **Completed** (about a minute) and shows the result;
4. click **Download PDF report**.

`demo-data/synthetic_too_few_slices.zip` is refused on purpose, with the reason shown.

The red **"DEMO MODEL: NOT FOR CLINICAL USE"** banner stays until the trained model is
installed ([section 9](#9-installing-the-trained-model)).

## 7. Everyday use

Run these in the CaviNet folder.

| Command | What it does |
|---|---|
| `make up` | Start CaviNet (and rebuild it after an update) |
| `make down` | Stop CaviNet. **All data is kept** |
| `make ps` | Show whether each service is running |
| `make logs` | Follow the services' logs (Ctrl+C to stop following) |
| `make backup` | Save the database and stored files to `backups/` |
| `make restore BACKUP=backups/<timestamp>` | Bring a backup back (replaces current data) |
| `make help` | List every command |

CaviNet restarts by itself when Docker Desktop starts (for example after a reboot), as long as
it was not stopped with `make down`.

## 8. Settings (.env)

`make up` creates `.env` on first run. It holds **passwords and secrets**: keep it private, do
not email it, and never add it to git (it is git-ignored). Change a setting by editing `.env`
with a text editor, then run `make up`.

| Setting | Default | Meaning |
|---|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin@cavinet.local`, generated | The first administrator, created on the first start only. Changing them later has no effect on an existing account |
| `DEMO_DOCTOR_EMAIL`, `DEMO_DOCTOR_PASSWORD` | `doctor@cavinet.local`, generated | Account created by `make seed` |
| `CAVINET_HTTP_PORT` | `8080` | Port of the web app (http://localhost:8080). Change it if 8080 is used by another program |
| `COOKIE_SECURE` | `false` | Set to `true` only if CaviNet is served over HTTPS |
| `MODEL_URL`, `MODEL_SHA256` | empty | Where `make fetch-model` downloads the trained model, and its checksum ([section 9](#9-installing-the-trained-model)) |
| `POSTGRES_PASSWORD`, `SECRET_KEY` | generated | Internal secrets. Do not change `POSTGRES_PASSWORD` after the first start (the database keeps the old one). Changing `SECRET_KEY` signs everyone out |

When a new version adds settings, `make up` adds them to your `.env` without touching the
existing values.

## 9. Installing the trained model

Until the real model is trained (see [TRAINING_RUNBOOK.md](TRAINING_RUNBOOK.md)), CaviNet uses
the demo model. When the team publishes the trained model as a GitHub Release:

1. In `.env`, set `MODEL_URL` to the release file's download link and `MODEL_SHA256` to its
   SHA-256 checksum (both in the release notes).
2. Run:

   ```bash
   make fetch-model FORCE=1
   make up
   ```

3. Sign in as an administrator and open **Model**: it shows the trained model's version and
   test results, and the DEMO banner is gone.

If the download fails or its checksum does not match `MODEL_SHA256`, the file is not used:
`make fetch-model` says why and installs the **demo model** instead. Check the **Model** page,
fix the link or checksum, and run both commands again.

## 10. Backups

```bash
make backup
```

writes `backups/<date-time>/` with `database.sql` (accounts, patients, cases, results,
notifications, audit log) and `data.tar.gz` (the de-identified scans and preview images).
CaviNet must be running. The AI model is not included (`make fetch-model` gets it again).

To restore:

```bash
make restore BACKUP=backups/20261005-091500
```

This **replaces all current data** with the backup; anything added since is lost. Typed in a
terminal, it asks you to type `yes` first. Afterwards, users may need to sign in again.

> **Backups contain patient records.** They are not encrypted. Keep them on the laptop's
> encrypted disk (FileVault, BitLocker) or an encrypted drive, never in git, email or a shared
> folder, and delete old ones you no longer need.

A good habit: `make backup` before every update and after every demo session with data worth
keeping.

## 11. Updating to a new version

```bash
make backup
git pull            # or: GitHub Desktop > Fetch origin > Pull
make up
```

`make up` rebuilds what changed and updates the database automatically. Your data, accounts and
model are kept.

## 12. Using CaviNet from other computers

CaviNet listens on the laptop's network connection too, so other devices on the **same
network** can open `http://<laptop-address>:8080` (find the address in the laptop's network
settings, e.g. `192.168.1.20`). The laptop's firewall may ask to allow Docker; allow it only
on a private network.

- The connection is plain HTTP (not encrypted). Use it only on a trusted private network,
  never on public Wi-Fi.
- Serving CaviNet over HTTPS (a reverse proxy with a certificate, then `COOKIE_SECURE=true`)
  is outside the scope of this prototype.

## 13. Troubleshooting

| Problem | What to do |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait for "Engine running". On Windows, check **WSL integration** is on for Ubuntu |
| `make: command not found` | Install make (section 2). On Windows, run the command in the **Ubuntu** window, not PowerShell |
| `port is already allocated` / `address already in use` | Another program uses port 8080. Set `CAVINET_HTTP_PORT=8090` in `.env`, run `make up`, then open http://localhost:8090 |
| `no space left on device` | Free disk space, then run `docker system prune` (removes unused Docker images and build files; CaviNet's data is kept) and `make up` again |
| The first `make up` is very slow | It is downloading. Let it finish; it resumes where it stopped if interrupted (run `make up` again) |
| `CaviNet did not become healthy` | Run `make ps` and `make logs`. Most often Docker has too little memory: give it at least 4 GB (section 2) |
| Scans stay on one status for many minutes | `make logs` shows the worker's messages; `docker compose restart worker` restarts the analysis service |
| Analysis fails with an out-of-memory message, or the worker restarts during analysis | Give Docker more memory (at least 4 GB), and close other large programs |
| Forgot the administrator's password | Another administrator can reset it on **Users**. If there is none: restore a backup, or start from scratch (section 14) |
| Something else | Run `docker compose logs > cavinet-logs.txt` and send the file to the developers. It should hold no passwords or patient details, but look through it before sending |

## 14. Removing CaviNet

```bash
make down                      # stop (data kept)
docker compose down -v         # stop AND DELETE all data: accounts, patients, scans, results
```

Then delete the CaviNet folder (including `.env` and `backups/`) and, if wanted, uninstall
Docker Desktop. `docker compose down -v` followed by `make up` starts again from a fresh, empty
CaviNet (with the same `.env`).

## 15. Setup timing checklist

The Phase 7 acceptance criterion is that, on a clean team laptop following this guide,
`make up` runs the full demo in under 15 minutes of setup. Record a run here:

| Step | Start | End |
|---|---|---|
| Section 3: `git clone` | | |
| Section 4: `make up` until "CaviNet is up" | | |
| Section 6: demo scan uploaded and result shown | | |

Laptop (model, RAM, OS): ______ · Internet speed: ______ · Total: ______ minutes ·
Checked by: ______ on ______

Installing the tools in section 2 (Docker Desktop, WSL) is a one-off step and is not counted.
