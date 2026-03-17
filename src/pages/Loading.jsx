import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import bg from "../assets/images/loading-bg.png"

function Loading() {
    const [progress, setProgress] = useState(0)
    const [imageLoaded, setImageLoaded] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (!imageLoaded) return

        let interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    navigate("/home")
                    return 100
                }
                return prev + 2 // ⚡ faster
            })
        }, 20)

        return () => clearInterval(interval)
    }, [imageLoaded])

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                overflow: "hidden"
            }}
        >

            {/* BACKGROUND */}
            <img
                src={bg}
                onLoad={() => setImageLoaded(true)}
                alt="bg"
                style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scale(1.05)", // 🔥 slight zoom (cinematic)
                }}
            />

            {/* DARK CINEMATIC OVERLAY */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9))"
                }}
            />

            {/* LOADING UI */}
            {imageLoaded && (
                <div
                    style={{
                        position: "absolute",
                        top: "55%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center"
                    }}
                >

                    {/* GLOW BAR */}
                    <div
                        style={{
                            width: "320px",
                            height: "6px",
                            background: "#111",
                            borderRadius: "10px",
                            overflow: "hidden",
                            boxShadow: "0 0 10px red"
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: "100%",
                                background:
                                    "linear-gradient(90deg, #ff0000, #ff6600, #ff0000)",
                                boxShadow: "0 0 20px red",
                                transition: "width 0.15s ease"
                            }}
                        />
                    </div>

                    {/* TEXT */}
                    <p
                        style={{
                            marginTop: "12px",
                            color: "#ccc",
                            fontSize: "12px",
                            letterSpacing: "2px"
                        }}
                    >
                        LOADING {progress}%
                    </p>

                </div>
            )}

        </div>
    )
}

export default Loading