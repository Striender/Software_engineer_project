import bg from "../assets/images/home-bg.jpeg"

function Home() {
    return (
        <div className="home-container">

            {/* BACKGROUND */}
            <img src={bg} className="bg-image" />

            {/* DARK OVERLAY */}
            <div className="overlay" />

            {/* TOP BAR */}
            <div className="top-bar">
                <div>
                    <h2>ADITYA</h2>
                    <p>Ralkzen Elite</p>
                </div>
                <div className="coins">2450</div>
            </div>

            {/* LEFT MENU */}
            <div className="left-menu">
                {["LOBBY", "AGENTS", "LOADOUT", "STATS", "LEADERBOARD", "STORE"].map(item => (
                    <div key={item} className="menu-item">{item}</div>
                ))}
            </div>

            {/* CENTER */}
            <div className="center-box">

                <button className="play-btn">
                    PLAY MATCH
                </button>

                <div className="sub-buttons">
                    <button>RANKED MODE</button>
                    <button>CUSTOM GAME</button>
                </div>

                <button className="training-btn">TRAINING</button>

            </div>

            {/* RIGHT PANEL */}
            <div className="party-box">
                <h3>PARTY</h3>
                <div className="party-item">YOU</div>
                <div className="party-item">+ INVITE</div>
                <div className="party-item">+ INVITE</div>
            </div>

            {/* BOTTOM BAR */}
            <div className="bottom-bar">
                MODE: DEATHMATCH &nbsp; | &nbsp; PING: 28ms &nbsp; | &nbsp; EVENT: NIGHTFALL RISING
            </div>

        </div>
    )
}

export default Home