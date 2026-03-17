import { useNavigate } from "react-router-dom"

function ComingSoon({ title = "COMING SOON" }) {
    const navigate = useNavigate()

    return (
        <div style={{
            width: "100%",
            height: "100vh",
            background: "radial-gradient(circle at center, #020617, #000)",
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "Orbitron, sans-serif"
        }}>

            <h1 style={{
                fontSize: "48px",
                letterSpacing: "4px",
                marginBottom: "20px"
            }}>
                {title}
            </h1>

            <p style={{
                opacity: 0.7,
                marginBottom: "30px"
            }}>
                Feature under development
            </p>

            <button
                onClick={() => navigate("/home")}
                style={{
                    padding: "12px 30px",
                    background: "linear-gradient(90deg, #0066ff, #00d4ff)",
                    border: "none",
                    color: "white",
                    cursor: "pointer"
                }}
            >
                GO BACK
            </button>

        </div>
    )
}

export default ComingSoon