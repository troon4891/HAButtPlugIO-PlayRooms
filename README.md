This is a Home Assistant add-on that hosts a Buttplug.io (Intiface Engine) server and exposes connected devices through a "Play Rooms" system. A PWA provides the guest/host interface. 

Hosts create customizable rooms with widgets (Toy Box, Web Cam, Video Chat, Voice Chat, Text Chat), then share them via generated links to allow others to access and play//watch them. 

---

### Project Aim

The aim of this project is to create an add-on for the Home Assistant platform that will host a Buttplug.io instance. This will allow users to connect their toys and expose them as Play Rooms to both the Home Assistant AI and a PWA for external access via Share Links.

The Progressive Web App (PWA) will provide a web-based dashboard for sharing and managing these devices through shareable links.

### What is a Play Room?

A Play Room is a customizable space where users can add "widgets" to enhance its functionality and layout. Each Play Room features both a **Guest view** and a **Host view**, accommodating 1 to 4 guests depending on the room settings.

Hosts determine how the room can be accessed, typically through an **open method** or a **challenge system**:

- **Challenge method**: When a guest joins a share link with a challenge, a code is generated that the guest must enter, or the host can approve their entry through a lobby. 
- **Open method**: Guests with this link can join by simply entering their name and selecting settings in the lobby.

Each Play Room includes established Room Rules and a Toy Box for toy management.

### What is a Share Link?

A Share Link is a generated URL that grants external access to a specific Play Room. The WebUI allows hosts to generate these links. When a guest clicks one, they enter the lobby flow determined by the room's access mode (open or challenge).

### Widgets

#### Toy Box
The Toy Box contains the Buttplug.io devices linked to this Play Room along with any preconfigured settings, options, and exposed buttons.

#### Web Cam
Enables the host to link a webcam and stream video to guests. Guests cannot connect their own cameras to this widget — it is host-only, one-way streaming.

#### Video Chat
Creates a small video wall for participants, with the option for the host to join. When the host opts in, their video connection automatically enables voice for all guests.

#### Voice Chat
A walkie-talkie-style voice chat that can operate in either a push-to-talk mode or a continuous open mic format.

#### Text Chat
Real-time text messaging between host and guests within the Play Room, with message persistence in the database.

