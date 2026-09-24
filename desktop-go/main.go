package main

import (
	"os"

	"aurastream/desktop/api"
	"aurastream/desktop/ui"
)

func main() {
	base := os.Getenv("AURA_URL")
	if base == "" {
		base = "http://151.247.210.55:7700"
	}
	ui.Run(api.New(base))
}
