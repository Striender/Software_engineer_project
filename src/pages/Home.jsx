import bg from "../assets/images/home-bg.jpeg"
import {
    Home as HomeIcon,
    Users,
    Shield,
    BarChart3,
    Trophy,
    ShoppingCart,
    UserPlus
} from "lucide-react"
import { useNavigate } from "react-router-dom"

function Home() {

    const navigate = useNavigate()

    const player = {
        name: "STRIENDER",
        rank: "Ralkzen Elite",
        coins: 2450
    }

    const gameInfo = {
        mode: "DEATHMATCH",
        ping: "28ms",
        event: "NIGHTFALL RISING"
    }

    return (
        <div className="home-container">

            <img src={bg} className="bg-image" />
            <div className="overlay" />

            {/* TOP BAR */}
            <div className="top-bar">

                {/* CLICKABLE PROFILE */}
                <div
                    className="profile-box"
                    onClick={() => navigate("/profile")}
                >
                    <div className="avatar" />
                    <div>
                        <h2>{player.name}</h2>
                        <p>{player.rank}</p>
                    </div>
                </div>

                <div className="coins-box">
                    {player.coins}
                </div>

            </div>

            {/* LEFT MENU */}
            <div className="left-menu">
                <div className="menu-item" onClick={() => navigate("/agents")}>AGENTS</div>
                <div className="menu-item" onClick={() => navigate("/loadout")}>LOADOUT</div>
                <div className="menu-item" onClick={() => navigate("/stats")}>STATS</div>
                <div className="menu-item" onClick={() => navigate("/leaderboard")}>LEADERBOARD</div>
                <div className="menu-item" onClick={() => navigate("/store")}>STORE</div>
            </div>

            {/* CENTER */}
            <div className="center-box">
                <button className="play-btn">PLAY MATCH</button>

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
                <div className="party-item"><UserPlus size={16} /> INVITE</div>
            </div>

            {/* BOTTOM BAR */}
            <div className="bottom-bar">
                MODE: {gameInfo.mode} | PING: {gameInfo.ping} | EVENT: {gameInfo.event}
            </div>

        </div>
    )
}

export default Home