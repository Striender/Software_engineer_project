import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import bg from "../assets/images/loading-bg.png"

function Loading() {
    const [progress, setProgress] = useState(0)
    const [imageLoaded, setImageLoaded] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (!imageLoaded) return

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    navigate("/home")
                    return 100
                }
                return prev + 1
            })
        }, 20)

        return () => clearInterval(interval)
    }, [imageLoaded])

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>

            {/* BACKGROUND IMAGE */}
            <img
                src={bg}
                alt="bg"
                onLoad={() => setImageLoaded(true)}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                }}
            />

            {/* DARK OVERLAY */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "rgba(0,0,0,0.4)"
                }}
            />

            {/* LOADING UI */}
            {imageLoaded && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center"
                    }}
                >

                    {/* Loading bar */}
                    <div
                        style={{
                            width: "300px",
                            height: "10px",
                            background: "#222",
                            borderRadius: "5px",
                            overflow: "hidden"
                        }}
                    >
                        <div
                            style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: "red",
                                transition: "width 0.2s"
                            }}
                        />
                    </div>

                    <p style={{ color: "white", marginTop: "10px" }}>
                        LOADING {progress}%
                    </p>

                </div>
            )}

        </div>
    )
}

export default Loading