package com.viagemestrada.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ScreenHeader(title: String, subtitle: String? = null) {
    Column(Modifier.padding(bottom = 12.dp)) {
        Text(title, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
        if (subtitle != null) {
            Text(subtitle, fontSize = 14.sp, color = LocalTripColors.current.muted)
        }
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        fontSize = 12.sp,
        letterSpacing = 1.sp,
        color = LocalTripColors.current.muted,
        modifier = Modifier.padding(top = 16.dp, bottom = 6.dp),
    )
}

@Composable
fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(LocalTripColors.current.card)
            .padding(14.dp),
    ) { content() }
}

/** Linha "rótulo ........ valor" como nas listas do mockup. */
@Composable
fun ValueRow(label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(LocalTripColors.current.card)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onBackground)
        Text(value, color = LocalTripColors.current.accent, fontWeight = FontWeight.Bold)
    }
}

/** Seletor segmentado (idioma, unidades). */
@Composable
fun <T> Segmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    val colors = LocalTripColors.current
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(colors.card)
            .padding(4.dp),
    ) {
        options.forEach { (value, label) ->
            val active = value == selected
            Text(
                label,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (active) colors.accent else colors.card)
                    .clickable { onSelect(value) }
                    .padding(vertical = 10.dp),
                color = if (active) colors.onAccent else MaterialTheme.colorScheme.onBackground,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

/** Chip selecionável (modelos da garagem). */
@Composable
fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = LocalTripColors.current
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(if (selected) colors.accent else colors.card)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        color = if (selected) colors.onAccent else MaterialTheme.colorScheme.onBackground,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
        fontSize = 14.sp,
    )
}
