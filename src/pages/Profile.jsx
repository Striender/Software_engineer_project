function Profile() {
    return (
        <div style={{
            width: "100%",
            height: "100vh",
            background: "linear-gradient(135deg, #0f172a, #020617)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "Orbitron, sans-serif"
        }}>

            <h1 style={{ fontSize: "40px", marginBottom: "20px" }}>
                PLAYER PROFILE
            </h1>

            <div style={{
                padding: "30px",
                background: "rgba(0,0,0,0.5)",
                border: "1px solid #00eaff",
                boxShadow: "0 0 20px #00eaff"
            }}>
                <p>Name: STRIENDER</p>
                <p>Rank: Ralkzen Elite</p>
                <p>Coins: 2450</p>
            </div>

        </div>
    )
}

export default Profile