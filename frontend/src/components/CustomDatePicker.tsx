import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './CustomDatePicker.css';

interface CustomDatePickerProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholderText?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    selected,
    onChange,
    placeholderText = 'Select date',
    minDate,
    maxDate,
    disabled = false,
}) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            const darkModeEnabled =
                document.documentElement.classList.contains('dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDarkMode(darkModeEnabled);
        };

        checkDarkMode();

        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', checkDarkMode);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener('change', checkDarkMode);
        };
    }, []);

    // Stabilize date references to prevent infinite re-render loops in react-datepicker
    const selectedTime = selected ? selected.getTime() : null;
    const memoizedSelected = useMemo(() => selected, [selectedTime]);

    const maxDateTime = maxDate ? maxDate.toDateString() : null;
    const memoizedMaxDate = useMemo(() => maxDate, [maxDateTime]);

    const minDateTime = minDate ? minDate.toDateString() : null;
    const memoizedMinDate = useMemo(() => minDate, [minDateTime]);

    // Stable custom header reference
    const renderCustomHeader = useCallback(({
        date,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
    }: any) => {
        return (
            <div className="figma-calendar-header">
                <button
                    type="button"
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                    className="figma-nav-button"
                    aria-label="Previous month"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="figma-header-text">
                    {MONTHS[date.getMonth()]} {date.getFullYear()}
                </div>
                <button
                    type="button"
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                    className="figma-nav-button"
                    aria-label="Next month"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        );
    }, []);

    return (
        <div className={`figma-datepicker-wrapper ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
            <div className="relative">
                <DatePicker
                    selected={memoizedSelected}
                    onChange={onChange}
                    minDate={memoizedMinDate}
                    maxDate={memoizedMaxDate}
                    disabled={disabled}
                    placeholderText={placeholderText}
                    dateFormat="d/M/yyyy"
                    className="figma-datepicker-input"
                    calendarClassName="figma-calendar"
                    showPopperArrow={false}
                    autoComplete="off"
                    renderCustomHeader={renderCustomHeader}
                />
            </div>
        </div>
    );
};

export default CustomDatePicker;
