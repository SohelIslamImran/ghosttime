package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/muesli/termenv"
	"golang.org/x/term"
)

const (
	MAX_FRAMES = 235
	ESC        = "\033["
)

var reader = bufio.NewReader(os.Stdin)

func readKey(input chan rune) {
	for {
		char, _, err := reader.ReadRune()
		if err != nil {
			log.Fatal(err)
		}
		input <- char
	}
}

func main() {
	fd := int(os.Stdin.Fd())
	oldState, err := term.MakeRaw(fd)
	if err != nil {
		log.Fatalf("Failed to enable raw mode: %v", err)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	output := termenv.NewOutput(os.Stdout)
	output.ClearScreen()
	output.HideCursor()
	defer output.ShowCursor()
	output.AltScreen()
	defer output.RestoreScreen()

	input := make(chan rune, 1)
	go readKey(input)

	frameIndex := 1

	for {
		select {
		case i := <-input:
			if i == 'q' {
				term.Restore(int(os.Stdin.Fd()), oldState)
				output.ShowCursor()
				output.RestoreScreen()
				output.ClearScreen()
				os.Exit(0)
			}
		default:

			paths := fmt.Sprintf("home/animation_frames/frame_%03d.txt", frameIndex)
			frame, err := readFrame(paths)
			if err != nil {
				fmt.Println(err)
			}
			renderFrame(frame, 24, *output)
			frameIndex++
			if frameIndex > MAX_FRAMES {
				frameIndex = 1
			}
		}
	}
}

type Frame struct {
	Lines []string
	Bold  map[int][]BoldSection
}

type BoldSection struct {
	Start   int
	End     int
	Content string
}

func readFrame(path string) (*Frame, error) {
	frameFile, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("ERROR: failed to open file: %s. %s", path, err)
	}
	defer frameFile.Close()

	frame := &Frame{
		Lines: make([]string, 0),
		Bold:  make(map[int][]BoldSection),
	}

	scanner := bufio.NewScanner(frameFile)
	lineNum := 0
	for scanner.Scan() {
		line := scanner.Text()
		re := regexp.MustCompile(`<span class="b">([^<]+)</span>`)
		matches := re.FindAllStringSubmatchIndex(line, -1)

		if len(matches) > 0 {
			spans := make([]BoldSection, 0)
			var processedLine strings.Builder
			currentPos := 0
			processedPos := 0

			for _, match := range matches {
				fullStart, fullEnd := match[0], match[1]
				contentStart, contentEnd := match[2], match[3]

				// Append text before the span
				processedLine.WriteString(line[currentPos:fullStart])
				processedPos += fullStart - currentPos

				// Extract bold content
				boldContent := line[contentStart:contentEnd]
				processedLine.WriteString(boldContent)

				// Record the bold section's position in the processed line
				boldStart := processedPos
				boldEnd := boldStart + len(boldContent)
				spans = append(spans, BoldSection{
					Start:   boldStart,
					End:     boldEnd,
					Content: boldContent,
				})

				// Update positions
				currentPos = fullEnd
				processedPos += len(boldContent)
			}

			// Append any remaining text after the last span
			processedLine.WriteString(line[currentPos:])
			frame.Lines = append(frame.Lines, processedLine.String())

			// Merge overlapping spans
			mergedSpans := mergeOverlappingSpans(spans)
			frame.Bold[lineNum] = mergedSpans
		} else {
			frame.Lines = append(frame.Lines, line)
		}

		lineNum++
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("ERROR: failure reading file: %s\n", err)
	}

	return frame, nil
}

// mergeOverlappingSpans takes a slice of BoldSection and merges any overlapping or adjacent spans.
func mergeOverlappingSpans(spans []BoldSection) []BoldSection {
	if len(spans) == 0 {
		return spans
	}

	// Sort spans by Start
	sort.Slice(spans, func(i, j int) bool {
		return spans[i].Start < spans[j].Start
	})

	merged := []BoldSection{spans[0]}

	for _, current := range spans[1:] {
		last := &merged[len(merged)-1]
		if current.Start <= last.End { // Overlapping or adjacent
			if current.End > last.End {
				last.End = current.End
				last.Content += current.Content[last.End-current.Start:]
			}
		} else {
			merged = append(merged, current)
		}
	}

	return merged
}

func renderFrame(frame *Frame, fps int, output termenv.Output) {
	delay := time.Second / time.Duration(fps)

	_, height, err := term.GetSize(int(os.Stdout.Fd()))
	if err != nil {
		fmt.Println(err)
		return
	}

	startLine := (height - len(frame.Lines)) / 2
	if startLine < 0 {
		startLine = 0 // Prevent negative start line
	}

	var buffer strings.Builder

	for i, line := range frame.Lines {
		// Calculate the line's vertical position
		linePosition := startLine + i + 1

		// Move cursor to the appropriate position using ANSI escape sequence
		// Format: \033[<line>;<column>H
		// Since CursorPositionSeq is "%d;%dH", prepend "\033[" and format it
		cursorMove := fmt.Sprintf(ESC+termenv.CursorPositionSeq, linePosition, 1)
		buffer.WriteString(cursorMove)

		spans, hasBold := frame.Bold[i]
		if !hasBold {
			buffer.WriteString(line)
		} else {
			// Print line with bold sections
			currentPos := 0
			for _, span := range spans {
				// Safety check to prevent out-of-range access
				if span.Start > len(line) || span.End > len(line) || span.Start > span.End {
					continue
				}
				// Print regular text before the bold section
				if currentPos < span.Start {
					buffer.WriteString(line[currentPos:span.Start])
				}

				// Apply bold and color to the bold section
				boldStyled := output.String(line[span.Start:span.End]).Bold().Foreground(termenv.ANSIBlue)
				buffer.WriteString(boldStyled.String())

				currentPos = span.End
			}

			// Print any remaining text after the last bold section
			if currentPos < len(line) {
				fmt.Print(line[currentPos:])
			}
		}
	}
	output.ClearScreen()
	fmt.Print(buffer.String())
	time.Sleep(delay)
}