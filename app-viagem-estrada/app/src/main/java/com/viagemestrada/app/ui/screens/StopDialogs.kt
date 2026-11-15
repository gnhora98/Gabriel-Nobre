package com.viagemestrada.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.viagemestrada.app.R
import com.viagemestrada.app.ui.Chip
import com.viagemestrada.app.ui.Format
import com.viagemestrada.app.ui.LocalTripColors
import com.viagemestrada.core.Stop
import com.viagemestrada.core.StopKind

@Composable
fun StopActionsDialog(stop: Stop, onDismiss: () -> Unit, onSetCurrent: () -> Unit, onEdit: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${Format.stopEmoji(stop)} ${stop.name}") },
        text = { stop.obs?.let { Text(it) } },
        confirmButton = { TextButton(onClick = onSetCurrent) { Text(stringResource(R.string.set_current)) } },
        dismissButton = { TextButton(onClick = onEdit) { Text(stringResource(R.string.edit)) } },
    )
}

/** Cria ou edita uma parada: nome, horário, km no dia e tipo. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StopEditDialog(
    original: Stop?,
    onDismiss: () -> Unit,
    onSave: (Stop) -> Unit,
    onDelete: (() -> Unit)?,
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(original?.name ?: "") }
    var time by remember { mutableStateOf(original?.time ?: "12:00") }
    var km by remember { mutableStateOf(original?.km?.let { "%.0f".format(it) } ?: "") }
    var kind by remember { mutableStateOf(original?.kind ?: StopKind.USER) }
    var error by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (original == null) R.string.new_stop_title else R.string.edit_stop_title)) },
        text = {
            Column {
                OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.field_name)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(time, { time = it }, label = { Text(stringResource(R.string.field_time)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    km, { km = it }, label = { Text(stringResource(R.string.field_km)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(stringResource(R.string.field_type), modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    StopKind.entries.forEach { k ->
                        Chip(Format.stopKindLabel(context, k), selected = k == kind) { kind = k }
                    }
                }
                if (error) {
                    Text(stringResource(R.string.invalid_input), color = LocalTripColors.current.warning, modifier = Modifier.padding(top = 8.dp))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val kmValue = km.replace(',', '.').toDoubleOrNull()
                val validTime = Regex("""^([01]\d|2[0-3]):[0-5]\d$""").matches(time.trim())
                if (name.isBlank() || kmValue == null || kmValue < 0 || !validTime) {
                    error = true
                } else {
                    val base = original ?: Stop(time = time, km = kmValue, name = name, type = Format.typeValue(kind))
                    onSave(base.copy(name = name.trim(), time = time.trim(), km = kmValue, type = Format.typeValue(kind)))
                }
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = {
            Column {
                if (onDelete != null) {
                    TextButton(onClick = onDelete) { Text(stringResource(R.string.delete), color = LocalTripColors.current.warning) }
                }
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
            }
        },
    )
}
